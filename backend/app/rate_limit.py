"""Limiter compartido de slowapi.

Vive en su propio módulo (en vez de definirse en main.py) para que los routers
puedan importarlo y decorar sus endpoints sin crear un import circular con main.py.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
