import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20261102141126 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "manual_payment_provider_setting" drop constraint if exists "manual_payment_provider_setting_provider_id_unique";`,
    )
    this.addSql(
      `alter table if exists "manual_payment_order" drop constraint if exists "manual_payment_order_order_id_unique";`,
    )
    this.addSql(
      `create table if not exists "manual_payment_order" ("id" text not null, "order_id" text not null, "provider_id" text not null, "reference" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "manual_payment_order_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_manual_payment_order_order_id_unique" ON "manual_payment_order" ("order_id") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_manual_payment_order_deleted_at" ON "manual_payment_order" ("deleted_at") WHERE deleted_at IS NULL;`,
    )

    this.addSql(
      `create table if not exists "manual_payment_provider_setting" ("id" text not null, "provider_id" text not null, "label" text null, "description" text null, "enabled" boolean not null default true, "rank" integer not null default 0, "countries" jsonb null, "min_total" jsonb null, "max_total" jsonb null, "currencies" jsonb null, "shipping_option_ids" jsonb null, "capture_mode" text check ("capture_mode" in ('manual', 'on_order', 'on_delivery')) not null default 'manual', "fee" jsonb null, "fee_label" text null, "instructions" text null, "bank_accounts" jsonb not null, "reference_template" text null, "reference_scheme" text check ("reference_scheme" in ('none', 'SI00', 'SI12', 'RF')) not null default 'none', "qr_type" text check ("qr_type" in ('none', 'epc', 'upn')) not null default 'none', "upn_purpose_code" text null, "auto_cancel_enabled" boolean not null default false, "auto_cancel_days" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "manual_payment_provider_setting_pkey" primary key ("id"));`,
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_manual_payment_provider_setting_provider_id_unique" ON "manual_payment_provider_setting" ("provider_id") WHERE deleted_at IS NULL;`,
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_manual_payment_provider_setting_deleted_at" ON "manual_payment_provider_setting" ("deleted_at") WHERE deleted_at IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "manual_payment_order" cascade;`)

    this.addSql(`drop table if exists "manual_payment_provider_setting" cascade;`)
  }
}
