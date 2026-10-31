import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const items = {
  index: ['Início', '◫'],
  transactions: ['Lançamentos', '⇄'],
  reports: ['Relatórios', '▤'],
  taxes: ['Impostos', '％'],
};

function TabGlyph({ name, color, size }) {
  return (
    <Text style={{ color, fontSize: size || 19, lineHeight: 23, fontWeight: '700' }}>
      {items[name][1]}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#168d68',
      tabBarInactiveTintColor: '#8793a2',
      tabBarLabelStyle: { fontSize: 9, fontWeight: '600', marginBottom: 4 },
      tabBarIconStyle: { marginTop: 4 },
      tabBarItemStyle: { minHeight: 55 },
      tabBarStyle: {
        minHeight: 61,
        paddingTop: 3,
        borderTopColor: '#e9edf2',
        backgroundColor: '#ffffff',
        elevation: 8,
      },
    }}>
      {Object.entries(items).map(([name, [title]]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarAccessibilityLabel: title,
            tabBarIcon: ({ color, size }) => <TabGlyph color={color} name={name} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
