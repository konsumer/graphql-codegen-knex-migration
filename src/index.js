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
    const links = {}
    const enums = {}
    const visitor = {
      ObjectTypeDefinition: node => {
        const tableName = tableize(underscore(node.name.value))
        // ignore non-db types
        if (!node.directives.find(d => d.name.value === 'db')) {
          return null
        }
        tables.push(node.name.value)
        const fields = []
        let primary
        node.fields.forEach(f => {
          const directives = {}
          f.directives.forEach(d => {
            directives[d.name.value] = {}
            d.arguments.forEach(a => {
              directives[d.name.value][a.name.value] = a.value.value
            })
          })

          if (!directives.nodb) {
            const { name, array, required } = getField(f.type)
            if (typeMap[name]) {
              // regular scalar type
              let out
              if (array) {
                // no good way to handle scalar arrays, just use json
                out = `t.json('${underscore(f.name.value)}')`
              } else {
                out = `t.${typeMap[name]}('${underscore(f.name.value)}')`
                if (required) {
                  out += '.notNull()'
                }
                if (!primary && name === 'ID') {
                  primary = f.name.value
                  out += '.primary()'
                }
              }
              fields.push(out)
            } else {
              // handle foreign-field
              // TODO: detect if this is 1-to-many, many-to-1, or many-to-many
              if (directives.link) {
                const otherTable = tableize(underscore(getField(schema._typeMap[name]._fields[directives.link.field].astNode.type).name))
                const tk = tableize(underscore(name))
                if (!links[tk]) {
                  links[tk] = []
                }
                links[tk].push({ link: directives.link, field: f, name: otherTable, array, required })
              } else {
                // no link, could be a connection to a type (other end) or an enum
                if (schema._typeMap[name].astNode.kind === 'EnumTypeDefinition') {
                  if (!array){
                    fields.push({ enum: true, name, array, required, field: f })
                  } else {
                    // no good way to handle array enums, just use json
                    fields.push(`t.json('${underscore(f.name.value)}')`)
                  }
                }
              }
            }
          }
        })
        return { fields, name: tableName }
      },

      // just add enums to dict for later lookup
      EnumTypeDefinition: node => {
        enums[ node.name.value ] = node.values.map(v => v.name.value)
        return node
      }
    }

    const inner = visit(parse(printSchemaWithDirectives(schema)), { leave: visitor }).definitions

    return `exports.up = async db => {
       ${inner.filter(t => t.kind !== 'EnumTypeDefinition').map(({ fields, name }) => `
         await db.schema.createTable('${name}', t => {
           ${fields.filter(f => !f.enum).join('\n')}
           ${links[name] ? links[name].map(j => `t.uuid('${underscore(j.link.field)}').index().references('id').inTable('${j.name}')`).join('\n') : ''}
           ${fields.filter(f => !!f.enum).map(({ name, field, required }) => {
              let out = `t.enum('${underscore(field.name.value)}', ${JSON.stringify(enums[name])})`
              if (required){
                out += '.notNull()'
              }
              return out
            }).join('\n')}
         })
       `).join('\n')}
     }
 
     exports.down = async db => {
       ${tables.map(t => `await db.schema.dropTable('${tableize(underscore(t))}')`).join('\n')}
     }
     `
  },
  addToSchema: `
    directive @db on OBJECT
    directive @nodb on FIELD | FIELD_DEFINITION
    directive @link(field: String!) on FIELD | FIELD_DEFINITION
  `
}
