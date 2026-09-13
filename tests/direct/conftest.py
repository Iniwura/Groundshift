"""Studio-dev v0.123 Direct Mode compatibility for the pinned Groundshift runner.

The released ``genlayer-test==0.29.2`` loader predates the GenVM Manager v0.6
runner bundle. Keep the contract's exact Depends hash and adapt only the test
harness to the current bundle/runtime used by Studio-dev.
"""

from __future__ import annotations

import io
import json
import os
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path
from typing import Any

import pytest

from gltest.direct import loader as direct_loader
from gltest.direct import wasi_mock
from gltest.direct.vm import VMContext


STUDIO_DEV_CHAIN_ID = 61997
GENVM_MANAGER_VERSION = "v0.6.0-rc5"
GENVM_MANAGER_BUNDLE = (
    "genvm-universal-genlayerlabs-genvm-manager-v0.6.0-rc5.tar.xz"
)
GENVM_MANAGER_NAMESPACE = "genlayerlabs-genvm-manager-v0.6.0-rc5"


def _resolve_manager_bundle() -> Path:
    """Use the current Manager bundle already shared with the working project."""
    cache_dir = Path.home() / ".cache"
    candidates = (
        cache_dir / "genvm-linter" / GENVM_MANAGER_BUNDLE,
        cache_dir / "gltest-direct" / "bundles-v2" / "genvm-universal-v0.6.0-rc5.tar.xz",
    )
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        "GenVM Manager v0.6.0-rc5 bundle not found; expected one of: "
        + ", ".join(str(candidate) for candidate in candidates)
    )


def _safe_extract_zip(archive: zipfile.ZipFile, destination: Path) -> None:
    destination_root = destination.resolve()
    for member in archive.infolist():
        member_path = (destination / member.filename).resolve()
        if member_path != destination_root and destination_root not in member_path.parents:
            raise ValueError(f"unsafe runner zip member: {member.filename}")
    archive.extractall(destination)


def _extract_current_runner(
    artifact_path: Path,
    runner_type: str,
    runner_hash: str,
) -> Path:
    """Extract a current-layout runner zip while retaining its exact hash."""
    extract_root = (
        Path.home()
        / ".cache"
        / "genvm-linter"
        / "extracted"
        / GENVM_MANAGER_NAMESPACE
    )
    runner_path = extract_root / runner_type / runner_hash
    if runner_path.exists() and any(runner_path.iterdir()):
        return runner_path

    runner_path.mkdir(parents=True, exist_ok=True)
    archive_name = (
        f"runners/{runner_type}/{runner_hash[:2]}/{runner_hash[2:]}.zip"
    )
    with tarfile.open(artifact_path, "r:xz") as outer_tar:
        member = outer_tar.getmember(archive_name)
        inner_archive = outer_tar.extractfile(member)
        if inner_archive is None:
            raise RuntimeError(f"Could not extract {archive_name}")
        with zipfile.ZipFile(io.BytesIO(inner_archive.read())) as archive:
            _safe_extract_zip(archive, runner_path)
    return runner_path


def _setup_sdk_paths(contract_path: Path, sdk_version: str | None = None) -> None:
    """Load the exact header runner and its manifest-pinned SDK dependencies."""
    from genvm_linter.validate import sdk_loader

    version = sdk_version or GENVM_MANAGER_VERSION
    if version != GENVM_MANAGER_VERSION:
        raise ValueError(
            f"Groundshift Direct Mode requires {GENVM_MANAGER_VERSION}, got {version}"
        )

    dependencies = sdk_loader.parse_contract_header(Path(contract_path))
    runner_hash = dependencies["py-genlayer"]
    artifact_path = _resolve_manager_bundle()
    runner_dir = _extract_current_runner(artifact_path, "py-genlayer", runner_hash)
    runner_deps = sdk_loader.parse_runner_manifest(runner_dir)

    std_hash = runner_deps["py-lib-genlayer-std"]
    std_dir = _extract_current_runner(
        artifact_path, "py-lib-genlayer-std", std_hash
    )

    sdk_paths = [std_dir]
    protobuf_root = runner_dir.parents[1] / "py-lib-protobuf"
    protobuf_dirs = sorted(path for path in protobuf_root.iterdir() if path.is_dir()) if protobuf_root.exists() else []
    if protobuf_dirs:
        sdk_paths.append(protobuf_dirs[-1])

    for sdk_path in reversed(sdk_paths):
        import_path = sdk_path / "src" if (sdk_path / "src").exists() else sdk_path
        if str(import_path) not in sys.path:
            sys.path.insert(0, str(import_path))


def _message_data(vm: VMContext) -> dict[str, Any]:
    from genlayer.types import Address

    def as_address(value: Any) -> Address:
        if isinstance(value, Address):
            return value
        if isinstance(value, bytes):
            return Address(value)
        if hasattr(value, "as_bytes"):
            return Address(value.as_bytes)
        return Address(value)

    sender = as_address(vm.sender)
    origin = as_address(vm.origin)
    contract = as_address(vm._contract_address)
    return {
        "contract_address": contract,
        "sender_address": sender,
        "origin_address": origin,
        "signer_address": sender,
        "stack": [],
        "value": vm._value,
        "datetime": vm._datetime,
        "is_init": False,
        "chain_id": vm._chain_id,
        "entry_kind": 0,
        "entry_data": b"",
        "entry_stage_data": None,
    }


def _refresh_current_message(vm: VMContext) -> None:
    """Refresh cached current-runtime message globals after prank/warp changes."""
    message = sys.modules.get("genlayer.message")
    if vm._contract_address is None:
        return
    if message is None:
        return

    data = _message_data(vm)
    message.raw = data
    message.__dict__.update(data)


def _inject_current_message(vm: VMContext) -> None:
    from genlayer import calldata

    encoded = calldata.encode(_message_data(vm))
    fd, path = tempfile.mkstemp()
    try:
        os.write(fd, encoded)
        os.lseek(fd, 0, os.SEEK_SET)
        original_stdin = os.dup(0)
        vm._original_stdin_fd = original_stdin
        os.dup2(fd, 0)
    finally:
        os.close(fd)
        os.unlink(path)

    _refresh_current_message(vm)


def _roundtrip_current_args(args: tuple[Any, ...], kwargs: dict[str, Any]):
    from genlayer import calldata

    encoded_args = calldata.encode(list(args))
    encoded_kwargs = calldata.encode(kwargs)
    return tuple(calldata.decode(encoded_args)), calldata.decode(encoded_kwargs)


def _current_gl_call(data: bytes, /) -> int:
    """Use the installed Direct Mode mock handlers with current calldata."""
    vm = wasi_mock.get_vm()
    fd_buffers = getattr(wasi_mock._local, "fd_buffers", {})
    from genlayer import calldata

    try:
        request = calldata.decode(data)
    except Exception as exc:
        vm._trace(f"gl_call decode error: {exc}")
        return 2**32 - 1

    if getattr(vm, "_in_nondet", False) and isinstance(request, dict):
        for operation in wasi_mock._CROSS_CONTRACT_OPS:
            if operation in request:
                raise RuntimeError(
                    f"Cross-contract call ({operation}) is forbidden inside "
                    "eq_principle/run_nondet."
                )

    response = wasi_mock._handle_gl_call(vm, request)
    if response is None:
        return 2**32 - 1
    if (
        isinstance(request, dict)
        and "ExecPrompt" in request
        and request["ExecPrompt"].get("response_format") == "json"
        and isinstance(response, dict)
        and not isinstance(response.get("ok"), str)
    ):
        response = {"ok": json.dumps(response["ok"])}
    encoded = response if isinstance(response, bytes) else calldata.encode(response)

    fd = getattr(wasi_mock._local, "fd_counter", 100)
    wasi_mock._local.fd_counter = fd + 1
    fd_buffers[fd] = io.BytesIO(encoded)
    wasi_mock._local.fd_buffers = fd_buffers
    return fd


def _patch_current_nondet() -> None:
    """Run the current SDK's leader directly while retaining validator capture."""
    import genlayer.vm as current_vm
    from genlayer.types import Lazy

    if getattr(current_vm, "_groundshift_direct_mode_patched", False):
        return

    def run(leader_fn, validator_fn, /, **_kwargs):
        vm = wasi_mock.get_vm()
        vm._in_nondet = True
        try:
            result = leader_fn()
        finally:
            vm._in_nondet = False
        vm._captured_validators.append((result, leader_fn, validator_fn))
        from genlayer import vm as genlayer_vm

        vm._in_nondet = True
        try:
            accepted = validator_fn(genlayer_vm.Return(calldata=result))
        finally:
            vm._in_nondet = False
        if type(accepted) is not bool or not accepted:
            raise RuntimeError("Direct Mode validator rejected nondeterministic result")
        return result

    def run_lazy(leader_fn, validator_fn, /, **kwargs):
        return Lazy(lambda: run(leader_fn, validator_fn, **kwargs))

    run.lazy = run_lazy
    current_vm.run_nondet = run
    current_vm.run_nondet_default = run
    current_vm._groundshift_direct_mode_patched = True


def _allocate_current(
    contract_cls: type[Any],
    vm: VMContext,
    *args: Any,
    **kwargs: Any,
) -> Any:
    """Use the current SDK storage allocator for the contract root."""
    from genlayer.storage import ROOT_SLOT_ID
    from genlayer.storage._internal.generate import (
        ORIGINAL_INIT_ATTR,
        _BuilderCtx,
        _storage_build,
    )

    type_desc = _storage_build(_BuilderCtx.empty(), contract_cls)
    slot = vm._storage.get_store_slot(ROOT_SLOT_ID)
    instance = type_desc.get(slot, 0)

    init = getattr(type_desc, "cls", None)
    if init is None:
        init = getattr(contract_cls, "__init__", None)
    else:
        init = getattr(init, "__init__", None)
    if init is not None:
        if hasattr(init, ORIGINAL_INIT_ATTR):
            init = getattr(init, ORIGINAL_INIT_ATTR)
        init(instance, *args, **kwargs)
    return instance


def _load_current_module(contract_path: Path) -> Any:
    import genlayer.contract as current_contract

    current_contract.__known_contract__ = None

    return direct_loader._legacy_load_module(contract_path)


_DIRECT_VALIDATOR_SENTINEL = object()


def _run_current_validator(
    self: VMContext,
    *,
    leader_result: Any = _DIRECT_VALIDATOR_SENTINEL,
    leader_error: Exception | None = None,
    index: int = -1,
) -> bool:
    """Replay a captured current-SDK validator without the obsolete gl.vm import."""
    if not self._captured_validators:
        raise RuntimeError(
            "No validator captured. Call a contract method that uses "
            "gl.vm.run_nondet before calling run_validator()."
        )

    stored_result, _leader_fn, validator_fn = self._captured_validators[index]
    import genlayer.vm as current_vm

    if leader_error is not None:
        wrapped = current_vm.UserError(str(leader_error))
    elif leader_result is not _DIRECT_VALIDATOR_SENTINEL:
        wrapped = current_vm.Return(calldata=leader_result)
    else:
        wrapped = current_vm.Return(calldata=stored_result)

    vm = wasi_mock.get_vm()
    vm._in_nondet = True
    try:
        return validator_fn(wrapped)
    finally:
        vm._in_nondet = False

def _install_compatibility() -> None:
    import gltest.direct.sdk_loader as legacy_sdk_loader

    legacy_sdk_loader.setup_sdk_paths = _setup_sdk_paths
    direct_loader._inject_message_to_fd0 = _inject_current_message
    direct_loader._calldata_roundtrip_args = _roundtrip_current_args
    direct_loader._patch_run_nondet_for_direct_mode = _patch_current_nondet
    direct_loader._allocate_contract = _allocate_current
    VMContext._refresh_gl_message = _refresh_current_message
    VMContext.run_validator = _run_current_validator
    direct_loader._legacy_load_module = direct_loader._load_module
    direct_loader._load_module = _load_current_module
    wasi_mock.gl_call = _current_gl_call


_install_compatibility()


@pytest.fixture(autouse=True)
def _studio_dev_chain(direct_vm: VMContext):
    direct_vm._chain_id = STUDIO_DEV_CHAIN_ID
    _refresh_current_message(direct_vm)
    yield
