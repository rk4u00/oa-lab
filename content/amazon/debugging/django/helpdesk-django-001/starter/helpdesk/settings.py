from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = "oa-lab-practice-only"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "tickets",
]

MIDDLEWARE = ["django.middleware.common.CommonMiddleware"]
ROOT_URLCONF = "helpdesk.urls"

DATABASES = {
    "default": {"ENGINE": "django.db.backends.sqlite3", "NAME": "/tmp/helpdesk.sqlite3"}
}

USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
