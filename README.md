# graphql-codegen-knex-migration

# WORK IN PROGRESS

## usage

This will allow you to generate database migrations to setup [knex](https://knexjs.org/) with [graphql-code-generator](https://graphql-code-generator.com/).

You can use this to create your data-store, and eventually I will have a resolver-generator, too that will work with it.

There are some custom schema-directives you can use:

```graphql
directive @db(table: String, key: String) on OBJECT
directive @nodb on FIELD | FIELD_DEFINITION
directive @link(field: String) on FIELD | FIELD_DEFINITION
```

You may want to add then to your own definitions, so your GraphQL doesn't throw any errors.

Use them like this:

```graphql
type User @db {
  # the first ID! field is the default key, and will be `id` field in the database
  id: ID!
  
  # this will be a an `email` field in the database
  email: String!

  # this will be a `first_name` field in the database
  firstName: String
  
  # this will be a `last_name` field in the database
  lastName: String
  
  # this will not be a field in the database (resolver-only)
  name: String @nodb

  # if Post is also using @db, this will be a link between `User.id` and `Post.id` via the `Post.author` field
  posts: [ Post ]! @link('author')
}

type Post @db {
  id: ID!
  title: String!
  body: String!
  author: User!
}

```

Add it to your `codegen.yml` like this:

```yml
schema: ./schema/**/*.graphql
generates:
  migrations/0_generated.js:
    plugins:
      - ./index.js
```

When you run `graphql-codegen`, you will get something that looks like this:

```js
exports.up = async db => {
  await db.schema.createTable('user', t => {
    t.uuid('id').notNullable().primary()
    t.string('email').notNull()
    t.string('first_name').notNull()
    t.string('last_name').notNull()
  })
  await db.schema.createTable('post', t => {
    t.uuid('id').notNullable().primary()
    t.string('title').notNull()
    t.string('body').notNull()
    t.foreign('author').references('id').inTable('user');
  })
}
exports.down = async db => {
  await db.schema.dropTable('user')
  await db.schema.dropTable('post')
}
```


### links

You can link fields with the `@link` directive, and it will detect if there is many-to-many (both are arrays) or one-to-many (this one is single, other one is array) or many-to-one (other is not array, but this one is.)

If it is many-to-many, a seperate table will be used to join them, otherwise a field on the `one` table will be used. In the above example, `Post.author` field will be used to join the tables, because it's the `one` and `posts` is the `many` field in the join.


### special scalar types

If you use custom scalar-types that have these names, an appropriate database field-type will be used:

```
Date
DateTime
Time
JSON
```

You will need to make your own type-resolvers. I recommend [graphql-type-json](https://www.npmjs.com/package/graphql-type-json) and [graphql-iso-date](https://www.npmjs.com/package/graphql-iso-date).

Arrays of scalars will use JSON-type in the database.

`ID` types will be stored as `UUID` in the database, to keep primary-keys unique across tables.

## development

* You can install tools & deps with `npm i`
* You can generate files in `migrations/` with `npm test`