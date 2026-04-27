declare module 'react-native-vector-icons/Ionicons' {
  import {Component} from 'react';
  import {TextStyle, ViewStyle} from 'react-native';

  interface IoniconsProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle | ViewStyle | Array<TextStyle | ViewStyle>;
  }

  export class Icon extends Component<IoniconsProps> {}
  export default Icon;
}
