import { View, ViewProps } from 'react-native';

export function Card({ children, className = '', ...props }: ViewProps) {
  return (
    <View
      className={`bg-surfaceElevated rounded-xl p-5 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
