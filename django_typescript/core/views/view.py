from rest_framework.decorators import api_view, permission_classes as add_permission_classes
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework import status

from django_typescript.core.types import PermissionClasses
from django_typescript.core import endpoints


# =================================
# View
# ---------------------------------

class View(object):

    REQUEST_METHOD: str = None

    def __init__(self, endpoint: endpoints.Endpoint, permission_classes: PermissionClasses = None):
        self.endpoint = endpoint
        self.permission_classes = permission_classes

    def _view_function(self):
        raise NotImplementedError

    def view(self):
        """
        Build a DRF function view.

        Policy decorators have to be applied to the raw function. Current DRF
        rejects ``@permission_classes`` wrapped around the result of ``@api_view``.
        """
        view_func = self._view_function()
        if self.permission_classes:
            view_func = add_permission_classes(self.permission_classes)(view_func)
        view_func.authentication_classes = api_settings.DEFAULT_AUTHENTICATION_CLASSES
        return api_view([self.REQUEST_METHOD])(view_func)

