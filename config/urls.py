"""config URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.conf import settings
from django.urls import path, include

urlpatterns = [
    path("", include("kms.urls")),
    path("kms/", include("kms.urls")),
]

# DEBUG 모드인 경우에만 추가할 URL
if settings.DEBUG == True:
    urlpatterns.append(path("admin/", admin.site.urls))

# 비정상 HTTP 응답코드 발생 시 리다이렉트
handler400 = "kms.views.views.error_400"
handler403 = "kms.views.views.error_403"
handler404 = "kms.views.views.error_404"
handler500 = "kms.views.views.error_500"
