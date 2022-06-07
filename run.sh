#!/bin/bash
export DJANGO_SETTINGS_MODULE="config.settings.production"
SCRIPT_PATH=$(dirname $(realpath $0))

source $SCRIPT_PATH/venv/bin/activate
$SCRIPT_PATH/venv/bin/python3 $SCRIPT_PATH/manage.py crontab add

sleep 3

nohup uwsgi --ini $SCRIPT_PATH/config/uwsgi.ini >/dev/null 2>&1 &
deactivate