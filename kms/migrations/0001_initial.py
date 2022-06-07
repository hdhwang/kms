# Generated by Django 3.1.7 on 2021-07-19 23:31

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Settings',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=64, unique=True)),
                ('value', models.CharField(max_length=1)),
                ('description', models.CharField(blank=True, max_length=64, null=True)),
            ],
            options={
                'db_table': 'settings',
            },
        ),
        migrations.CreateModel(
            name='Keyinfo',
            fields=[
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.DO_NOTHING, primary_key=True, serialize=False, to='auth.user')),
                ('key', models.CharField(max_length=64)),
                ('value', models.TextField()),
                ('description', models.CharField(blank=True, max_length=128, null=True)),
                ('created_date', models.DateTimeField()),
            ],
            options={
                'db_table': 'keyinfo',
                'unique_together': {('user', 'key')},
            },
        ),
        migrations.CreateModel(
            name='IpWhitelist',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ip', models.PositiveIntegerField()),
                ('cidr', models.PositiveIntegerField()),
                ('comment', models.CharField(blank=True, max_length=128, null=True)),
            ],
            options={
                'db_table': 'ip_whitelist',
                'unique_together': {('ip', 'cidr')},
            },
        ),
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ip', models.PositiveIntegerField(blank=True, null=True)),
                ('category', models.CharField(blank=True, max_length=32, null=True)),
                ('sub_category', models.CharField(blank=True, max_length=32, null=True)),
                ('action', models.TextField()),
                ('result', models.CharField(max_length=1)),
                ('date', models.DateTimeField()),
                ('user', models.ForeignKey(blank=True, db_column='user', null=True, on_delete=django.db.models.deletion.DO_NOTHING, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'audit_log',
            },
        ),
    ]
