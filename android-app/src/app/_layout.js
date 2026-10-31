import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FinanceProvider } from '../FinanceContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <FinanceProvider>
        <StatusBar style="light" backgroundColor="#101b2d" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </FinanceProvider>
    </SafeAreaProvider>
  );
}
