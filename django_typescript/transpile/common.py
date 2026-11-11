import inspect

from django_typescript.core.utils.signature import Signature
from django_typescript.transpile.field_type import FieldTypeTranspiler
from django_typescript.transpile.python_types import python_type_to_typescript, unwrap_optional
from django_typescript.core import typescript_types


# The view always injects the first receiver (instance, class, or request meta).
_SKIPPED_RECEIVER_PARAMS = {'self', 'cls', 'meta'}


# =================================
# Render Type Declaration
# ---------------------------------

def render_type_declaration(name: str, optional: bool, readonly: bool, type_: str):
    return (readonly * "readonly ") + name + (optional * "?") + ": " + type_


# =================================
# Method Signature
# ---------------------------------

def _declaration_for_serializer_field(name, field):
    return render_type_declaration(
        name=name,
        optional=bool(field.allow_null),
        readonly=bool(field.read_only),
        type_=FieldTypeTranspiler.transpile(field),
    )


def _declaration_for_hint(param, serializer_fields):
    if param.name in serializer_fields:
        return _declaration_for_serializer_field(param.name, serializer_fields[param.name])
    hint = param.type
    if hint is inspect.Parameter.empty:
        return render_type_declaration(
            name=param.name,
            optional=param.has_default,
            readonly=False,
            type_=typescript_types.ANY,
        )
    optional_hint, inner = unwrap_optional(hint)
    return render_type_declaration(
        name=param.name,
        optional=param.has_default or optional_hint,
        readonly=False,
        type_=python_type_to_typescript(inner),
    )


def method_sig_interface(arg_serializer_cls=None, signature: Signature = None):
    """
    Build the TypeScript ``data`` parameter for a generated method.

    DRF serializer fields win when a parameter has both a serializer and a
    Python annotation. Annotations cover every other parameter, including
    methods that do not declare ``arg_serializer_cls`` at all.
    """
    serializer_fields = {}
    if arg_serializer_cls is not None:
        serializer_fields = arg_serializer_cls().get_fields()

    type_declarations = []
    seen = set()
    if signature is not None:
        for param in signature.parameters.values():
            if param.name in _SKIPPED_RECEIVER_PARAMS:
                continue
            seen.add(param.name)
            type_declarations.append(_declaration_for_hint(param, serializer_fields))
    for field_name, field in serializer_fields.items():
        if field_name in seen or field_name in _SKIPPED_RECEIVER_PARAMS:
            continue
        type_declarations.append(_declaration_for_serializer_field(field_name, field))
    if not type_declarations:
        return ''
    return "data: {" + ", ".join(type_declarations) + "}"
