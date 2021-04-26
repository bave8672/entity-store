# @bave8672/rx-entity-store

Provides an rxjs observable API layer over a key-value store, similar to a redux store but much simpler. Intended for use as an in-memory cache for entities requested over a network.

## Installation

Add the following line to your project's `.npmrc` file:

```
@bave8672:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @bave8672/rx-entity-store
```

## Example Usage:

```typescript
// Imagine our app deals with books
interface Book {
    ISBN: string;
    title: string;
    author: string;
}

// And imagine we have a CRUD API over the network
interface RestAPI {
    getBooks(): Promise<Book[]>;
    getBook(isbn: string): Promise<Book>;
    updateBook(book: Book): Promise<Book>;
    deleteBook(isbn: string): Promise<Book>;
}

// we can define a store to help cache these books
// for reuse in multiple places
import { EntityStore } from "@bave8672/rx-entity-store";
const bookStoreConfig = {
    key: "books", // a name for our store
    idAccessor: (book) => book.ISBN, // use the ISBN as an ID
};
const bookStore = new EntityStore(bookStoreConfig);

// now we can use our store to cache them from within a global book service
class BookService {
    private getBooksRequest?: Observable<Book[]>;

    getBooks(refresh: boolean): Observable<Book[]> {
        if (refresh) {
            bookStore.setMany(RestAPI.getBooks());
        }
        return bookStore.getAll();
    }

    getBook(isbn: string): Observable<Book> {
        return bookStore.getOrSet(isbn, () => RestAPI.getBooks());
    }

    updateBook(book: Book): Observable<Book> {
        return bookStore.set(RestAPI.updateBook(book));
    }

    deleteBook(isbn: string): Observable<void> {
        bookStore.delete(RestAPI.deleteBook(isbn));
    }
}

// now we can consume book entities from elsewhere in the app
// and be sure we are getting the latest value
// without making redundant requests to the API
class BookSearchComponent {
    this.book = this.isbnSearchInput.pipe(switchMap(bookService.getBook);
}

class BookDetailComponent {
    this.book = bookService.getBook(this.isbn);
}

// other services or components can reuse the store to create, update or delete entities
// and all changes will be replayed to all observers.
```

## Docs

https://bave8672.github.io/entity-store/

## Contributing

```bash
npm ci # install deps
npm run test # run tests
```
