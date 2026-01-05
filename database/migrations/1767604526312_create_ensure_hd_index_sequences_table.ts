import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  public async up() {
    await this.db.raw('CREATE SEQUENCE IF NOT EXISTS users_hd_index_seq')
  }

  public async down() {
    // Intentionally left empty to prevent accidental deletion of the sequence
    // as it is required by the User model and other migrations.
  }
}
