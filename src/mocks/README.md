# Mock Service Worker (MSW) Setup

This directory contains the Mock Service Worker (MSW) configuration for intercepting and mocking API requests during development and testing.

## What is MSW?

Mock Service Worker (MSW) is an API mocking library that uses Service Workers to intercept requests on the network level. It allows you to:

- Develop without a backend
- Test API integrations
- Create predictable, reproducible test environments
- Prototype features before the API is ready

## Files

### `handlers/`

Contains all the request handlers for mocked API endpoints organized by feature:
- `todoHandlers.ts` - Todo CRUD operations with Faker.js integration
- `authHandlers.ts` - Authentication endpoints (login, register, refresh, logout)
- `index.ts` - Central export combining all handlers

**Features:**
- Complete CRUD operations for todos
- Pagination and filtering support
- Bulk operations (bulk delete, bulk update)
- Error handling and validation
- Realistic mock data using Faker.js and Lodash

### `browser.ts`

Sets up MSW for browser environments (development mode). Exports a `worker` instance that intercepts requests in the browser using a Service Worker.

### `node.ts`

Sets up MSW for Node.js environments (testing with Vitest). Exports a `server` instance that intercepts requests during tests.

## Usage

### Development Mode

To enable MSW in development:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Set the mocking flag in `.env`:
   ```env
   VITE_ENABLE_MOCKING=true
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. All requests to `/api/*` will be intercepted and mocked

### Testing

MSW is automatically enabled in tests via `src/test/setup.ts`. No additional configuration needed.

Example test:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TodoList } from './TodoList';

describe('TodoList', () => {
  it('should fetch and display todos', async () => {
    render(<TodoList />);

    await waitFor(() => {
      expect(screen.getByText('Setup MSW for API mocking')).toBeInTheDocument();
    });
  });
});
```

## Adding New Handlers

To add a new API endpoint:

1. Create a new handler file in `handlers/` (e.g., `handlers/userHandlers.ts`)
2. Add handlers using the `http` helpers:

```typescript
import { http, HttpResponse } from 'msw';

export const userHandlers = [
  // GET endpoint
  http.get('/api/users', () => {
    return HttpResponse.json({
      success: true,
      data: [
        { id: 1, name: 'John Doe' },
        { id: 2, name: 'Jane Smith' },
      ],
    });
  }),

  // POST endpoint
  http.post('/api/users', async ({ request }) => {
    const newUser = await request.json();
    return HttpResponse.json(
      {
        success: true,
        data: { id: 3, ...newUser },
      },
      { status: 201 }
    );
  }),
];
```

3. Export the handlers from `handlers/index.ts`:

```typescript
import { userHandlers } from './userHandlers';

export const handlers = [
  ...todoHandlers,
  ...authHandlers,
  ...userHandlers, // Add new handlers here
];
```

## Mock Data

Mock data is generated using Faker.js and Lodash for realistic, scalable data:

```typescript
import { faker } from '@faker-js/faker';
import _ from 'lodash';

// Set seed for reproducible data
faker.seed(12345);

// Generate multiple items
const mockTodos = _.times(10, (i) => ({
  id: i + 1,
  title: faker.hacker.phrase(),
  description: faker.lorem.paragraph(),
  completed: faker.datatype.boolean(0.3),
}));
```

For persistence across page refreshes, you can use `localStorage` or `IndexedDB`.

## Response Formats

All mock responses follow these formats:

### Success Response
```typescript
{
  success: true,
  data: T, // Your data
  message?: string
}
```

### Error Response
```typescript
{
  success: false,
  message: string,
  errors?: Record<string, string[]>
}
```

### Paginated Response
```typescript
{
  data: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number,
    hasMore: boolean
  }
}
```

## Simulating Network Delays

To simulate realistic network conditions, add delays:

```typescript
http.get('/api/todos', async () => {
  // Simulate 1 second delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return HttpResponse.json({
    success: true,
    data: mockTodos,
  });
});
```

## Simulating Errors

To test error handling:

```typescript
http.get('/api/todos', () => {
  return HttpResponse.json(
    {
      success: false,
      message: 'Internal server error',
    },
    { status: 500 }
  );
});
```

## Request Inspection

During development, MSW logs intercepted requests to the console:

```
[MSW] GET /api/todos (200 OK)
[MSW] POST /api/todos (201 Created)
```

To see request details, check the Network tab in DevTools.

## Disabling MSW

To disable MSW:

1. Set `VITE_ENABLE_MOCKING=false` in `.env`
2. Restart the dev server

Requests will now go to your actual API backend.

## Best Practices

1. **Keep handlers simple**: Focus on returning the right data structure
2. **Match your real API**: Use the same response formats as your backend
3. **Handle edge cases**: Test error states, validation, empty lists
4. **Use TypeScript**: Type your request/response bodies
5. **Document your handlers**: Add comments explaining what each handler does
6. **Organize by feature**: Group related handlers together in separate files
7. **Use realistic data**: Use Faker.js for realistic mock data
8. **Use Lodash**: Leverage Lodash for data manipulation and filtering

## Troubleshooting

### MSW not intercepting requests

1. Check that `VITE_ENABLE_MOCKING=true` in `.env`
2. Verify the Service Worker is registered (check DevTools > Application > Service Workers)
3. Ensure your API calls use the same base URL (e.g., `/api/todos`)

### Service Worker registration failed

1. Make sure you're running on `localhost` or `https`
2. Service Workers don't work on `file://` protocol
3. Check browser console for errors

### Tests failing with network errors

1. Verify `src/test/setup.ts` is imported in your test configuration
2. Check that handlers are defined for the endpoints you're testing
3. Look for handler errors in test output

## Resources

- [MSW Documentation](https://mswjs.io/docs/)
- [MSW Examples](https://mswjs.io/docs/basics/examples)
- [Faker.js Documentation](https://fakerjs.dev/)
- [Lodash Documentation](https://lodash.com/docs/)
- [Service Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
