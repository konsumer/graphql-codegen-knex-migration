const { printSchema } = require('graphql')

module.exports = {
  plugin: (schema, documents, config) => {
    console.log(printSchema(schema))
  },
  addToSchema: `
    directive @db(table: String, key: String) on OBJECT
    directive @nodb on FIELD | FIELD_DEFINITION
    directive @link(field: String) on FIELD | FIELD_DEFINITION
  `
}
