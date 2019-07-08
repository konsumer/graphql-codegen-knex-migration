const { printSchema } = require('graphql')

module.exports = {
  plugin: (schema, documents, config) => {
    console.log(printSchema(schema))
  }
}
