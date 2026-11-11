import typing
import re

from django.db import models
from rest_framework import serializers
from django.urls import path
from rest_framework.generics import CreateAPIView

from django_typescript.model_types.serializer import ModelTypeSerializer
from django_typescript.core.model_inspector import ModelInspector
from django_typescript.core import types
from django_typescript.core.utils import unwrap_method
from django_typescript.model_types.views import (CreateView,
                                                 DeleteView,
                                                 GetView,
                                                 GetOrCreateView,
                                                 ListView,
                                                 ModelMethodView,
                                                 ModelStaticMethodView,
                                                 UpdateView,
                                                 ModelPropertyView)


URL_PARAM = '<pk>'


# =================================
# Interface Model Type
# ---------------------------------

class ModelType(object):

    """
    A `ModelType` represents a single Django `Model` for which a
    TypeScript representation will be 'transpiled', and views/urls
    generated appropriately.

    """
    _MODEL_CLS: types.ModelClass = None

    _LOOKUP_TREE: types.PermissionClasses = None
    _RELATION_POOL: types.ModelPool = None
    _CREATE_PERMISSIONS: types.PermissionClasses = None
    _GET_PERMISSIONS: types.PermissionClasses = None
    _DELETE_PERMISSIONS: types.PermissionClasses = None
    _UPDATE_PERMISSIONS: types.PermissionClasses = None
    _SERIALIZER_FIELD_KWARGS: dict = None
    _ONE_TO_ONE_PROXY_FIELDS: types.OneToOneProxyFields = None
    _PROPERTY_FIELDS: typing.List[str] = None

    def __init__(self, model_cls: typing.Type[models.Model], create_permissions: types.PermissionClasses = None,
                 get_permissions: types.PermissionClasses = None, delete_permissions: types.PermissionClasses = None,
                 update_permissions: types.PermissionClasses = None, serializer_field_kwargs: dict = None,
                 one_to_one_proxy_fields: types.OneToOneProxyFields = None, property_fields: typing.List[str] = None):

        """

        Parameters
        ----------
        model_cls: The django `Model` class this `ModelType` represents.
        create_permissions
        get_permissions
        delete_permissions
        update_permissions
        """

        self.model_cls = model_cls
        self.model_inspector = ModelInspector(model_cls=model_cls)
        self.serializer: ModelTypeSerializer = ModelTypeSerializer(model_cls=model_cls,
                                                                   validate_func=getattr(self, "validate", None),
                                                                   serializer_field_kwargs=serializer_field_kwargs,
                                                                   one_to_one_proxy_fields=one_to_one_proxy_fields)

        self.create_view = CreateView(serializer=self.serializer,
                                      serializer_cls=self.serializer.base_serializer_cls,
                                      permission_classes=create_permissions)
        self.delete_view = DeleteView(serializer=self.serializer,
                                      serializer_cls=self.serializer.base_serializer_cls,
                                      permission_classes=delete_permissions)
        self.get_view = GetView(serializer=self.serializer, serializer_cls=self.serializer.base_serializer_cls,
                                permission_classes=get_permissions)
        self.get_or_create_view = GetOrCreateView(serializer=self.serializer,
                                                  serializer_cls=self.serializer.base_serializer_cls,
                                                  permission_classes=create_permissions)
        self.list_view = ListView(serializer=self.serializer, serializer_cls=self.serializer.base_serializer_cls,
                                  permission_classes=get_permissions)
        self.update_view = UpdateView(serializer=self.serializer, serializer_cls=self.serializer.base_serializer_cls,
                                      permission_classes=update_permissions)
        self.one_to_one_proxy_fields = one_to_one_proxy_fields
        self.property_fields = property_fields

    def __init_subclass__(cls, **kwargs):
        model_cls = kwargs.get('model_cls', None)
        if model_cls is None:
            raise AssertionError("No `model_cls` provided in `ModelType` class-init keyword arguments.")
        create_permissions = kwargs.get('create_permissions')
        get_permissions = kwargs.get('get_permissions')
        delete_permissions = kwargs.get('delete_permissions')
        update_permissions = kwargs.get('update_permissions')
        one_to_one_proxy_fields = kwargs.get('one_to_one_proxy_fields')
        serializer_field_kwargs = kwargs.get('serializer_field_kwargs')
        property_fields = kwargs.get('property_fields')
        cls._MODEL_CLS = model_cls
        cls._CREATE_PERMISSIONS = create_permissions
        cls._GET_PERMISSIONS = get_permissions
        cls._DELETE_PERMISSIONS = delete_permissions
        cls._UPDATE_PERMISSIONS = update_permissions
        cls._SERIALIZER_FIELD_KWARGS = serializer_field_kwargs
        cls._ONE_TO_ONE_PROXY_FIELDS = one_to_one_proxy_fields
        cls._PROPERTY_FIELDS = property_fields

    @classmethod
    def as_type(cls) -> 'ModelType':
        type_ = cls(model_cls=cls._MODEL_CLS, create_permissions=cls._CREATE_PERMISSIONS,
                    get_permissions=cls._GET_PERMISSIONS, delete_permissions=cls._DELETE_PERMISSIONS,
                    update_permissions=cls._UPDATE_PERMISSIONS, serializer_field_kwargs=cls._SERIALIZER_FIELD_KWARGS,
                    one_to_one_proxy_fields=cls._ONE_TO_ONE_PROXY_FIELDS, property_fields=cls._PROPERTY_FIELDS)
        return type_

    @property
    def serializer_cls(self):
        return self.serializer.base_serializer_cls

    @property
    def model_fields(self) -> typing.List[types.ModelField]:
        return self.model_cls._meta.get_fields()

    @property
    def method_views(self):
        method_views = []
        for k, v in self.__class__.__dict__.items():
            v = unwrap_method(v)
            if isinstance(v, ModelMethodView):
                method_views.append(v)
        return method_views

    @property
    def static_method_views(self):
        static_method_views = []
        for k, v in self.__class__.__dict__.items():
            v = unwrap_method(v)
            if isinstance(v, ModelStaticMethodView):
                static_method_views.append(v)
        return static_method_views

    @property
    def property_views(self):
        property_views = []
        if self.property_fields is not None:
            for property_field_name in self.property_fields:
                property_views.append(ModelPropertyView(property_name=property_field_name,
                                                        model_cls=self.model_cls))
        return property_views

    @classmethod
    def method(cls, permission_classes=None, arg_serializer_cls: typing.Type[serializers.Serializer] = None,
               **serializer_fields: serializers.Field):
        """
        Register Type `Method`...

        """

        def decorator(func):
            method = ModelMethodView(func=func, permission_classes=permission_classes,
                                     arg_serializer_cls=arg_serializer_cls, **serializer_fields)
            return method

        return decorator

    @classmethod
    def static_method(cls, permission_classes=None, arg_serializer_cls: typing.Type[serializers.Serializer] = None,
                      **serializer_fields: serializers.Field):
        """
        Register Type `Method`...

        """
        def decorator(func):
            static_method = ModelStaticMethodView(func=func, permission_classes=permission_classes,
                                                  arg_serializer_cls=arg_serializer_cls, **serializer_fields)
            return static_method

        return decorator

    def urlpatterns(self):
        """
        Return the Django URL patterns for this ModelType.

        :return:
        """
        urlpatterns = [
            path(self.create_view.endpoint.url(), self.create_view.view(), name='create'),
            path(self.delete_view.endpoint.url(URL_PARAM), self.delete_view.view(), name='delete'),
            path(self.get_view.endpoint.url(URL_PARAM), self.get_view.view(), name='get'),
            path(self.get_or_create_view.endpoint.url(), self.get_or_create_view.view(), name='get_or_create'),
            path(self.list_view.endpoint.url(), self.list_view.view(), name='list'),
            path(self.update_view.endpoint.url(URL_PARAM), self.update_view.view(), name='update'),
        ]
        for method_view in self.method_views:
            # Pass the method view this ModelType's serializer class.
            method_view.model_serializer_cls = self.serializer.base_serializer_cls
            urlpatterns.append(
                path(method_view.endpoint.url(URL_PARAM), method_view.view(), name=method_view.name),
            )
        for static_method_view in self.static_method_views:
            static_method_view.model_type_cls = self.__class__
            urlpatterns.append(
                path(static_method_view.endpoint.url(), static_method_view.view(), name=static_method_view.name),
            )
        for property_view in self.property_views:
            urlpatterns.append(
                path(property_view.endpoint.url(URL_PARAM), property_view.view(), name=property_view.name),
            )
        return urlpatterns

    @property
    def model_name(self):
        return self.model_cls.__name__

    def base_url(self):
        """
        Return the 'base url' for this interface `Type`. For a model `CamelCase`,
        this will return `camel-case`.

        """
        matches = re.finditer('.+?(?:(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|$)', self.model_name)
        return "-".join([m.group(0).lower() for m in matches])




