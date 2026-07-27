import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Ajoute le symbole du token et sa source sur les offres P2P
    this.schema.alterTable('p2p_offers', (table) => {
      table.string('token_symbol', 20).notNullable().defaultTo('BNX') // Symbole du token (ex: BNX)
      table.string('token_source', 20).notNullable().defaultTo('airdrop') // Source du token : "airdrop"
    })

    // Ajoute le symbole du token sur les trades
    this.schema.alterTable('p2p_trades', (table) => {
      table.string('token_symbol', 20).notNullable().defaultTo('BNX')
    })
  }

  async down() {
    this.schema.alterTable('p2p_offers', (table) => {
      table.dropColumn('token_symbol')
      table.dropColumn('token_source')
    })
    this.schema.alterTable('p2p_trades', (table) => {
      table.dropColumn('token_symbol')
    })
  }
}
