import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const apiUrl = import.meta.env.VITE_API_URL;
const httpLink = createHttpLink({
  uri: apiUrl ? `${apiUrl}/graphql` : '/graphql',
  credentials: 'include',
});

const wsProtocol = apiUrl ? (apiUrl.startsWith('https') ? 'wss:' : 'ws:') : (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
const wsHost = apiUrl ? new URL(apiUrl).host : window.location.host;

const wsLink = new GraphQLWsLink(
  createClient({
    url: `${wsProtocol}//${wsHost}/graphql`,
    connectionParams: () => {
      return {};
    },
    retryAttempts: 5,
    shouldRetry: () => true,
  })
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
  },
  wsLink,
  httpLink
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          conversations: {
            keyArgs: ['projectId', 'filter'],
            merge(existing, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
