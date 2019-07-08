# graphql-codegen-knex-migration

# WORK IN PROGRESS

This will allow you to generate database migrations to setup [knex](https://knexjs.org/) with [graphql-code-generator](https://graphql-code-generator.com/).

You can use this to create your data-store, and eventually I will have a resolver-generator, too that will work with it.

There are some custom schema-directives you can use:

```graphql
directive @db(table: String, key: String) on OBJECT
directive @nodb on FIELD | FIELD_DEFINITION
```

You may want to add then to your own definitions, so your GraphQL doesn't throw any errors.

Use them like this:

```graphql
type User @db {
  # the first ID! field is the default key, and will be id field in the database
  id: ID!
  
  # this will be a an email field in the database
  email: String!

  # this will be a first_name field in the database
  firstName: String
  
  # this will be a last_name field in the database
  lastName: String
  
  # this will not be a field in the database (resolver-only)
  name: String @nodb

  # if Post is also using @db, this will be a link table between User.id and Post.id
  posts: [ Post ]!
}
```

## development

* You can install tools & deps with `npm i`
* You can generate files in `migrations/` with `npm test`