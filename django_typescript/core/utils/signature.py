import inspect
import typing
from collections import OrderedDict
from typing import Callable, Type, Dict


# =================================
# Parameter
# ---------------------------------

class Parameter(object):

    def __init__(self, name, type_: Type, optional: bool):
        self.name = name
        self.type = type_
        self.has_default = optional


# =================================
# Signature
# ---------------------------------

class Signature(object):

    def __init__(self, callable_: Callable):
        self.callable = callable_
        self.parameters: Dict[str, Parameter] = OrderedDict()

        self._make_parameters()

    def __contains__(self, item):
        return item in self.parameters

    def __len__(self):
        return len(self.parameters.keys())

    @property
    def param_names(self):
        return [p.name for p in self.parameters.values()]

    def _make_parameters(self):
        signature = inspect.signature(self.callable)
        try:
            hints = typing.get_type_hints(self.callable)
        except Exception:
            hints = {}
        for param in signature.parameters.values():
            if param.name != 'self':
                annotation = hints.get(param.name, param.annotation)
                self.parameters[param.name] = Parameter(name=param.name,
                                                        type_=annotation,
                                                        optional=param.default != inspect.Parameter.empty)

    def __getitem__(self, item) -> Parameter:
        return self.parameters[item]