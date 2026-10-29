import { View, Text } from 'react-native';

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View className="bg-errorSoft rounded-xl p-3 mb-4">
      <Text className="text-error text-sm">{message}</Text>
    </View>
  );
}
