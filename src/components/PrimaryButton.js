import { LinearGradient } from 'expo-linear-gradient';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

export default function PrimaryButton({ title="+  Su Ekle", onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{flex:1}}>
      <LinearGradient colors={[COLORS.primaryStart, COLORS.primaryEnd]} style={styles.btn}>
        <Text style={styles.txt}>+  Su Ekle</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  btn:{ paddingVertical:16, borderRadius:18, alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOpacity:0.12, shadowRadius:10, elevation:2 },
  txt:{ color:'#fff', fontSize:16, fontWeight:'700' }
});