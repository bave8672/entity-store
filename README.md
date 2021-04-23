# rx-entity-store

Provides an rxjs observable API layer over a key-value store, similar to a redux store but much simpler. Intended for use as an in-memory cache for entities requested over a network.

## Example:

```typescript
// Imagine our app deals with books
interface Book {
    ISBN: string;
    title: string;
    author: string;
}

// And imagine we have a CRUD API over the network
interface RestAPI {
    getBooks(): Observable<Book[]>;
    getBook(isbn: string): Observable<Book>;
    updateBook(book: Book): Observable<Book>;
    deleteBook(isbn: string): Observable<Book>;
}

// we can define a store to help cache these books
// for reuse in multiple places
import { EntityStore } from "rx-entity-store";
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

// etc...
```
