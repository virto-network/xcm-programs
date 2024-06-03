export function makeAccountId32(id: string) {
  return {
    AccountId32: {
      network: null,
      id,
    },
  };
}
