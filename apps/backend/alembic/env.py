import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Ensure backend app directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.db.base import Base
import app.models.associations  # noqa: F401
import app.models.permission_model  # noqa: F401
import app.models.role_model  # noqa: F401
import app.models.user_model  # noqa: F401
import app.models.session_model  # noqa: F401
import app.models.category_model  # noqa: F401
import app.models.product_type_model  # noqa: F401
import app.models.brand_model  # noqa: F401
import app.models.unit_model  # noqa: F401
import app.models.product_model  # noqa: F401
import app.models.partner_model  # noqa: F401
import app.models.purchase_model  # noqa: F401
import app.models.notification_model  # noqa: F401
import app.models.stock_model  # noqa: F401
import app.models.sale_model  # noqa: F401
import app.models.quote_model  # noqa: F401
import app.models.delivery_note_model  # noqa: F401
import app.models.invoice_model  # noqa: F401
import app.models.payment_model  # noqa: F401

# Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name:
    fileConfig(config.config_file_name)

# Set target metadata for 'autogenerate' support
target_metadata = Base.metadata

# Set database URL dynamically from application settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
