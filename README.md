# graphql-codegen-knex-migration

# WORK IN PROGRESS

This will allow you to generate database migrations to setup [knex](https://knexjs.org/) with [graphql-code-generator](https://graphql-code-generator.com/).

You can use this with [graphql-codegen-knex-joinmonster](https://github.com/konsumer/graphql-codegen-knex-joinmonster) to create the join-monster meta info that matches this.

To see a complete example project, checkout [graphql-codegen-knex-example](https://github.com/konsumer/graphql-codegen-knex-example)

## usage

There are some custom schema-directives you can use:

```graphql
# set a type as a database-model
directive @db on OBJECT

# leave a field out of the database (resolver-only)
directive @nodb on FIELD | FIELD_DEFINITION

# link to another table's field for relation
directive @link(field: String!) on FIELD | FIELD_DEFINITION
```

You may want to add then to your own definitions, so your GraphQL doesn't throw any errors.

Use them like this:

```graphql
type Post @db {
  # the first ID! field is the default key, and will be `id` field in the database
  id: ID!
  
  # this will be a a `title` field in the database
  title: String!
  
  # this will be a a `body` field in the database
  body: String!
  
  # because the other type is joined on this field, this will be where the database keeps references to `User.id`
  author: User!
}

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
  posts: [ Post ]! @link(field: "author")

  testEnum: TestEnum
}

enum TestEnum {
  A
  B
  C
}

```

Make sure you've got `id: ID!` on all your `@db` types.

Add it to your `codegen.yml` like this:

```yml
schema: ./schema/**/*.graphql
generates:
  migrations/0_generated.js:
    plugins:
      - graphql-codegen-knex-migration
```

When you run `graphql-codegen`, you will get something that looks like this:

```js
exports.up = async db => {
  await db.schema.createTable("posts", t => {
    t.uuid("id")
      .notNull()
      .primary();
    t.string("title").notNull();
    t.string("body").notNull();
    t.uuid("author")
      .index()
      .references("id")
      .inTable("users");
  });

  await db.schema.createTable("users", t => {
    t.uuid("id")
      .notNull()
      .primary();
    t.string("email").notNull();
    t.string("first_name");
    t.string("last_name");

    t.enum("test_enum", ["A", "B", "C"]);
  });
};

exports.down = async db => {
  await db.schema.dropTable("posts");
  await db.schema.dropTable("users");
};
```


### relationships

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

`ID` types will be stored as `UUID` in the database, to keep keys unique across tables.
