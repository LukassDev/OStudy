import { View, Text } from 'react-native';

export function SuccessBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View className="bg-successSoft rounded-xl p-3 mb-4">
      <Text className="text-success text-sm">{message}</Text>
    </View>
  );
}
