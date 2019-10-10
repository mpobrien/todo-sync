const Realm = require('realm');
const uuid = require('uuid').v4;
const process = require('process');
const argv = process.argv.slice(2);
const SERVER_URL = 'http://localhost:9080';
const REALM_SERVER_URL = 'realm://localhost:9080';

const TodoItemSchema = {
  name: 'TodoItem',
  properties: {
    summary: 'string',
    done: 'bool',
  },
};

const TodoListSchema = {
  name: 'TodoList',
  primaryKey: '_id',
  properties: {
    ownerId: 'string',
    _id: 'string',
    items: 'TodoItem[]',
  },
};

function repaint(lists) {
  process.stdout.write('\x1b[2J');

  lists.forEach(list => {
    console.log(
      'My TODO List: ',
      list._id,
      list.items.length,
      list.items.length == 1 ? 'entry' : 'entries',
    );
    list.items.forEach((item, index) => {
      console.log(index + 1 + '.', item.done ? '[✔]' : '[ ]', item.summary);
    });
  });
}

async function listsFullSync(user) {
  const config = await user.createConfiguration({
    schema: [TodoItemSchema, TodoListSchema],
    sync: {
      url: REALM_SERVER_URL + '/~/my_todo_lists',
      path: 'foo',
      fullSynchronization: true,
    },
  });
  const realm = await Realm.open(config);

  const lists = realm
    .objects('TodoList')
    .filtered('ownerId == $0', user.identity);

  return {realm, lists};
}

(async () => {
  const user = await Realm.Sync.User.login(
    SERVER_URL,
    Realm.Sync.Credentials.usernamePassword(argv[0], argv[1]),
  );

  const {realm, lists} = await listsFullSync(user);

  if (lists.length == 0) {
    // First time user? If so, make a list for them
    realm.write(() => {
      realm.create('TodoList', {
        ownerId: user.identity,
        _id: uuid(),
        items: [
          {summary: 'an item', done: false},
          {summary: 'a completed item', done: true},
        ],
      });
    });
  }

  if (argv.length > 2) {
    switch (argv[2]) {
      case 'toggle':
        const index = parseInt(argv[3]) - 1;
        realm.write(() => {
          lists[0].items[index].done = !lists[0].items[index].done;
        });
        break;
      case 'add':
        const newItem = argv[3];
        realm.write(() => {
          lists[0].items.push({summary: newItem, done: false});
        });
        break;
    }
    process.exit(0);
    return;
  }

  repaint(lists);

  lists.addListener(change => {
    repaint(lists);
  });
})();
