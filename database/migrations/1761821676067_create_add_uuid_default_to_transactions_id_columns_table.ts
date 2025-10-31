import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    await this.db.raw('ALTER TABLE ?? ALTER COLUMN ?? SET DEFAULT gen_random_uuid()', [
      this.tableName,
      'id',
    ])
  }

  async down() {
    await this.db.raw('ALTER TABLE ?? ALTER COLUMN ?? DROP DEFAULT', [this.tableName, 'id'])
  }
}
