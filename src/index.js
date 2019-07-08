const { visit, parse } = require('graphql')
const { printSchemaWithDirectives } = require('graphql-toolkit')
const { tableize, underscore } = require('inflection')

const typeMap = {
  String: 'string',
  ID: 'uuid'

}

const getField = (type, info = { required: false, array: false }) => {
  if (type.kind === 'NamedType') {
    return { ...info, name: type.name.value }
  }
  if (type.kind === 'NonNullType') {
    info.required = true
    return getField(type.type, info)
  }
  if (type.kind === 'ListType') {
    info.array = true
    return getField(type.type, info)
  }
}

module.exports = {
  plugin: (schema, documents, config) => {
    const tables = []
    const visitor = {
      ObjectTypeDefinition: node => {
        if (!node.directives.find(d => d.name.value === 'db')) {
          return null
        }
        tables.push(node.name.value)
        const fields = []
        let primary
        node.fields.forEach(f => {
          if (!f.directives.find(d => d.name.value === 'nodb')) {
            const { name, array, required } = getField(f.type)
            // TODO: more field-processing
            if (typeMap[name]) {
              let out = `t.${typeMap[name]}('${underscore(f.name.value)}')`
              if (required) {
                out += '.notNull()'
              }
              if (!primary && name === 'ID') {
                primary = f.name.value
                out += '.primary()'
              }
              fields.push(out)
            }
          }
        })
        return `
        await db.schema.createTable('${tableize(underscore(node.name.value))}', t => {
          ${fields.join('\n')}
        })
        `
      }
    }

    const inner = visit(parse(printSchemaWithDirectives(schema)), { leave: visitor }).definitions.filter(l => l).join('\n')
    return `exports.up = async db => {
      ${inner}
    }

    exports.down = async db => {
      ${tables.map(t => `await db.schema.dropTable('${tableize(underscore(t))}')`).join('\n')}
    }
    `
  },
  addToSchema: `
    directive @db(table: String, key: String) on OBJECT
    directive @nodb on FIELD | FIELD_DEFINITION
    directive @link(field: String) on FIELD | FIELD_DEFINITION
  `
}
