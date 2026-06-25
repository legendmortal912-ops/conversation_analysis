import type { DataLoaders } from '../../dataloaders/index.js';

export const turnResolvers = {
  Turn: {
    flags: async (parent: any, _: any, context: { loaders: DataLoaders }) => {
      return context.loaders.flagsByTurnId.load(parent.id);
    },
  },
};
