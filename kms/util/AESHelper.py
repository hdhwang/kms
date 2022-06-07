from Crypto.Cipher import AES
from kms.util.formatHelper import *

import base64
import logging
logger = logging.getLogger(__name__)

BLOCK_SIZE = 32
pad = (lambda s: s + (BLOCK_SIZE - len(s) % BLOCK_SIZE) * chr(BLOCK_SIZE - len(s) % BLOCK_SIZE).encode())
unpad = (lambda s: s[:-ord(s[len(s) - 1:])])


class AESCipher(object):
    def __init__(self, key, iv):
        self.key = bytes.fromhex(key)
        self.iv = bytes.fromhex(iv)

    def encrypt(self, message):
        try:
            message = message.encode()
            raw = pad(message)
            cipher = AES.new(self.key, AES.MODE_CBC, self.iv)
            enc = cipher.encrypt(raw)
            return base64.b64encode(enc).decode('utf-8')

        except Exception as e:
            logger.warning(f'[encrypt] {to_str(e)}')

    def decrypt(self, enc):
        try:
            enc = base64.b64decode(enc)
            cipher = AES.new(self.key, AES.MODE_CBC, self.iv)
            dec = cipher.decrypt(enc)
            return unpad(dec).decode('utf-8')

        except Exception as e:
            logger.warning(f'[decrypt] {to_str(e)}')
