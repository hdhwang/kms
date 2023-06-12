from django.db import models
from django.contrib.auth.models import User


class ChoiceYN(models.IntegerChoices):
    Y = 1
    N = 0


class AuditLog(models.Model):
    user = models.CharField(max_length=128, blank=True, null=True)
    ip = models.PositiveIntegerField(blank=True, null=True)
    category = models.CharField(max_length=32, blank=True, null=True)
    sub_category = models.CharField(max_length=32, blank=True, null=True)
    action = models.TextField()
    result = models.IntegerField(choices=ChoiceYN.choices)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_log"


class IpWhitelist(models.Model):
    ip = models.PositiveIntegerField()
    cidr = models.PositiveIntegerField()
    comment = models.CharField(max_length=128, blank=True, null=True)

    class Meta:
        db_table = "ip_whitelist"
        unique_together = (("ip", "cidr"),)


class Keyinfo(models.Model):
    user = models.OneToOneField(User, models.DO_NOTHING, primary_key=True)
    key = models.CharField(max_length=64)
    value = models.TextField()
    description = models.CharField(max_length=128, blank=True, null=True)
    created_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "keyinfo"
        unique_together = (("user", "key"),)


class Settings(models.Model):
    key = models.CharField(unique=True, max_length=64)
    value = models.CharField(max_length=1)
    description = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        db_table = "settings"
