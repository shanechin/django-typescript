import typing
import inspect

from django.urls import path, include
from django.db import models
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework import status

from django_typescript.object_types.object_type import ObjectType
from django_typescript.core.utils import camel_case_to_underscore
from django_typescript.model_types.model_type import ModelType
from django_typescript.utils import CurrentUserIDDefault


# =================================
# Interface
# ---------------------------------

class Interface(object):

    """
    Class for defining a django-typescript 'interface'.

    """

    _TRANSPILE_DEST: str = None

    def __init_subclass__(cls, **kwargs):
        transpile_dest = kwargs.get('transpile_dest')
        assert transpile_dest is not None, 'A `transpile_dest` argument must be supplied to' \
                                            ' any subclass of `Interface`.'
        cls._TRANSPILE_DEST = transpile_dest

    @classmethod
    def model_types(cls) -> typing.List[ModelType]:
        """
        Return the list of `interface.ModelType` instances associated with this
        Interface.

        """
        model_types = []
        for k, v in cls.__dict__.items():
            if isinstance(v, ModelType):
                model_types.append(v)
        return model_types

    @classmethod
    def obj_types(cls) -> typing.List[typing.Type[ObjectType]]:
        """
        Return the list of `interface.ObjectType` sub-classes associated with this
        Interface.

        """
        object_types = []
        for k, v in cls.__dict__.items():
            if inspect.isclass(v):
                if issubclass(v, ObjectType):
                    object_types.append(v)
        return object_types

    @classmethod
    def models(cls) -> typing.List[typing.Type[models.Model]]:
        """
        Return list of Model classes for this Interface. Each `interface.Type`
        has a model.

        """
        models_ = list()
        for interface_model_type in cls.model_types():
            models_.append(interface_model_type.model_cls)
        return models_

    @classmethod
    def urlpatterns(cls, extra_patterns: list = None):
        """
        Return the Django URL patterns for this interface.

        """
        urlpatterns = []
        for interface_model_type in cls.model_types():
            urlpatterns.append(
                path('{}/'.format(interface_model_type.base_url()),
                     include((interface_model_type.urlpatterns(), camel_case_to_underscore(interface_model_type.model_name)))),
            )
        for object_type in cls.obj_types():
            urlpatterns.append(
                path('{}/'.format(object_type.base_url()),
                     include((object_type.urlpatterns(),
                              camel_case_to_underscore(object_type.__name__)))),
            )
        if extra_patterns:
            urlpatterns += extra_patterns
        return urlpatterns

    @classmethod
    def base_url(cls):
        return '/'