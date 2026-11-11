import typing
import re

from rest_framework import serializers
from django.urls import path

from django_typescript.core.utils import unwrap_method
from django_typescript.core.utils.signature import Signature
from django_typescript.object_types.views import ObjectMethodView, ObjectStaticMethodView


# =================================
# Interface Object Type
# ---------------------------------

class ObjectType(object):

    _SERIALIZER_CLS: typing.Type[serializers.Serializer] = None

    _METHOD_VIEWS: typing.List[ObjectMethodView] = []
    _STATIC_METHOD_VIEWS: typing.List[ObjectStaticMethodView] = []

    def __init_subclass__(cls, **kwargs):
        serializer_cls = kwargs.get('serializer_cls')
        if serializer_cls is None:
            raise AssertionError("`ObjectType` subclasses must be provided with a class-level `serializer_cls` keyword "
                                 "argument.")
        field_names = list(serializer_cls().get_fields().keys())
        init_sig = Signature(callable_=cls.__init__)
        if set(field_names) != set(init_sig.param_names):
            raise AssertionError("An `ObjectType`'s `serializer_cls` fields must match the `__init__` signature.")
        cls._SERIALIZER_CLS = serializer_cls

    @classmethod
    def method_views(cls) -> typing.List[ObjectMethodView]:
        method_views = []
        for k, v in cls.__dict__.items():
            v = unwrap_method(v)
            if isinstance(v, ObjectMethodView):
                method_views.append(v)
        return method_views

    @classmethod
    def static_method_views(cls) -> typing.List[ObjectStaticMethodView]:
        static_method_views = []
        for k, v in cls.__dict__.items():
            v = unwrap_method(v)
            if isinstance(v, ObjectStaticMethodView):
                static_method_views.append(v)
        return static_method_views

    @classmethod
    def base_url(cls):
        """
        Return the 'base url' for this interface `Type`. For a model `CamelCase`,
        this will return `camel-case`.

        """
        matches = re.finditer('.+?(?:(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|$)', cls.__name__)
        return "-".join([m.group(0).lower() for m in matches])

    @classmethod
    def urlpatterns(cls):
        """
        Return the django urlpatterns for this `ObjectType`.

        """
        urlpatterns = []
        for method_view in cls.method_views():
            # Pass the method view this ObjectTypes's serializer class and ObjectType class.
            method_view.object_serializer_cls = cls._SERIALIZER_CLS
            method_view.object_type_class = cls
            urlpatterns.append(
                path(method_view.endpoint.url(), method_view.view(), name=method_view.name),
            )
        for static_method_view in cls.static_method_views():
            static_method_view.object_type_class = cls
            urlpatterns.append(
                path(static_method_view.endpoint.url(), static_method_view.view(), name=static_method_view.name),
            )
        return urlpatterns

    @classmethod
    def method(cls, permission_classes=None, arg_serializer_cls: typing.Type[serializers.Serializer] = None,
               **arg_serializers: serializers.Field):
        """
        Decorates an `ObjectType` method to act as an `ObjectTypeMethodView`.

        """

        def decorator(func):
            method = ObjectMethodView(func=func, permission_classes=permission_classes,
                                      arg_serializer_cls=arg_serializer_cls, **arg_serializers)
            return method

        return decorator

    @classmethod
    def static_method(cls, permission_classes=None, arg_serializer_cls: typing.Type[serializers.Serializer] = None,
                      **arg_serializers: serializers.Field):
        """
        Decorates an `ObjectType` method to act as an `ObjectStaticMethodView`.

        """

        def decorator(func):
            method = ObjectStaticMethodView(func=func, permission_classes=permission_classes,
                                            arg_serializer_cls=arg_serializer_cls, **arg_serializers)
            return method

        return decorator

