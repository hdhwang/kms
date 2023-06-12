from rest_framework import serializers
from .models import Keyinfo


class KeyinfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Keyinfo
        fields = ("key", "value", "description")
        # fields = '__all__'
