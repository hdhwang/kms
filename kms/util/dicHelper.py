import logging

logger = logging.getLogger(__name__)


def insert_dic_data(mapping, key, value):
    if value is not None:
        mapping[key] = value


def get_dic_value(dic, key, default_val=""):
    result = default_val

    if dic and key and dic.get(key):
        result = dic.get(key)

    return result


def dict_fetch_all(cursor):
    desc = cursor.description
    return [dict(zip([col[0] for col in desc], row)) for row in cursor.fetchall()]
