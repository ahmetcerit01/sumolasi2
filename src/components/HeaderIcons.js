import { View, StyleSheet, Text } from 'react-native';

export default function HeaderIcons() {
  return (
    <View style={styles.row}>
      <View style={styles.icon}><Text>🔔</Text></View>
      <View style={styles.icon}><Text>🏆</Text></View>
      <View style={styles.icon}><Text>👤</Text></View>
    </View>
  );
}
const styles = StyleSheet.create({
  row:{ flexDirection:'row', gap:8 },
  icon:{ width:34, height:34, borderRadius:17, backgroundColor:'rgba(255,255,255,0.35)', alignItems:'center', justifyContent:'center' }
});