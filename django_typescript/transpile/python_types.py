import datetime
import decimal
import enum
import inspect
import typing

from django.db import models

from django_typescript.core import typescript_types
from django_typescript.transpile.literal import LiteralTranspiler


_UNION_ORIGINS = {typing.Union}
_UNION_TYPE = getattr(typing, 'UnionType', None)
if _UNION_TYPE is None:
    import types as _stdlib_types
    _UNION_TYPE = getattr(_stdlib_types, 'UnionType', None)
if _UNION_TYPE is not None:
    _UNION_ORIGINS.add(_UNION_TYPE)


def unwrap_optional(hint):
    """
    Split ``X | None`` / ``Optional[X]`` into ``(True, X)``.

    Other hints are returned unchanged as ``(False, hint)``.
    """
    origin = typing.get_origin(hint)
    if origin not in _UNION_ORIGINS:
        return False, hint
    args = list(typing.get_args(hint))
    if type(None) not in args:
        return False, hint
    rest = [arg for arg in args if arg is not type(None)]
    if not rest:
        return True, type(None)
    if len(rest) == 1:
        return True, rest[0]
    return True, typing.Union[tuple(rest)]


def python_type_to_typescript(hint) -> str:
    """
    Map a Python type hint to a TypeScript type expression.

    Unknown hints become ``any``. This is used for view/method parameters that
    are not described by a DRF serializer field.
    """
    if hint is inspect.Parameter.empty:
        return typescript_types.ANY
    if hint is typing.Any:
        return typescript_types.ANY
    if hint is type(None):
        return typescript_types.NULL
    if hint is bool:
        return typescript_types.BOOLEAN
    if hint is int:
        return typescript_types.NUMBER
    if hint is float:
        return typescript_types.NUMBER
    if hint is str:
        return typescript_types.STRING
    if hint is bytes:
        return typescript_types.STRING
    if hint in (datetime.datetime, datetime.date, datetime.time):
        # DRF encodes temporal values as ISO strings.
        return typescript_types.STRING
    if hint is decimal.Decimal:
        return typescript_types.NUMBER
    if hint in (dict, typing.Dict):
        return 'Record<string, any>'
    if hint in (list, typing.List, set, typing.Set, tuple, typing.Tuple):
        return 'any[]'

    origin = typing.get_origin(hint)
    args = typing.get_args(hint)

    if origin in _UNION_ORIGINS:
        return " | ".join(python_type_to_typescript(arg) for arg in args) or typescript_types.ANY

    if origin is typing.Literal:
        if not args:
            return typescript_types.ANY
        return " | ".join(LiteralTranspiler.transpile(arg) for arg in args)

    list_origins = {
        list, set, frozenset,
        typing.List, typing.Set, typing.FrozenSet,
        typing.Sequence, typing.Iterable, typing.Collection,
    }
    try:
        import collections.abc as abc
        list_origins.update({abc.Sequence, abc.Iterable, abc.Collection, abc.Set})
    except Exception:
        pass
    if origin in list_origins:
        inner = python_type_to_typescript(args[0]) if args else typescript_types.ANY
        return f'{inner}[]'

    mapping_origins = {dict, typing.Dict, typing.Mapping, typing.MutableMapping}
    try:
        import collections.abc as abc
        mapping_origins.update({abc.Mapping, abc.MutableMapping})
    except Exception:
        pass
    if origin in mapping_origins:
        if len(args) == 2:
            return f'Record<{python_type_to_typescript(args[0])}, {python_type_to_typescript(args[1])}>'
        return 'Record<string, any>'

    if origin in (tuple, typing.Tuple):
        if len(args) == 2 and args[1] is Ellipsis:
            return python_type_to_typescript(args[0]) + '[]'
        if args:
            return '[' + ', '.join(python_type_to_typescript(arg) for arg in args) + ']'
        return 'any[]'

    if inspect.isclass(hint):
        try:
            if issubclass(hint, enum.Enum):
                members = list(hint)
                if not members:
                    return typescript_types.ANY
                return " | ".join(LiteralTranspiler.transpile(member.value) for member in members)
        except TypeError:
            pass
        try:
            if issubclass(hint, models.Model):
                return hint.__name__
        except TypeError:
            pass

    return typescript_types.ANY
