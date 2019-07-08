const { visit, parse } = require('graphql')
const { printSchemaWithDirectives } = require('graphql-toolkit')
const { tableize, underscore } = require('inflection')

const typeMap = {
  Int: 'integer',
  Float: 'float',
  Boolean: 'boolean',
  String: 'string',
  ID: 'uuid',
  DateTime: 'dateTime',
  Date: 'date',
  Time: 'time',
  JSON: 'json'
}

// get the root-type and check if it's an array/required
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
        // TODO: use db.table arg
        node.fields.forEach(f => {
          const directives = {}

          f.directives.forEach(d => {
            directives[d.name.value] = {}
            d.arguments.forEach(a => {
              directives[d.name.value][a.name.value] = a.value.value
            })
          })
          if (Object.keys(directives).indexOf('nodb') === -1) {
            const { name, array, required } = getField(f.type)
            if (typeMap[name]) {
              // regular scalar type
              let out = `t.${typeMap[name]}('${underscore(f.name.value)}')`
              if (array) {
                out = `t.json('${underscore(f.name.value)}')`
              } else {
                if (required) {
                  out += '.notNull()'
                }
                // TODO: use db.key arg
                if (!primary && name === 'ID') {
                  primary = f.name.value
                  out += '.primary()'
                }
              }
              fields.push(out)
            } else {
              // handle foreign-field
              if (Object.keys(directives).indexOf('link') !== -1) {

              }
            }
          }
        })
        // handle relationships
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
    directive @link(field: String!) on FIELD | FIELD_DEFINITION
  `
}
