import React, { useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  LinearTransition,
  runOnJS,
} from 'react-native-reanimated';
import { spacing } from '../../constants/theme';

const COLUMNS = 2;
// Largura fixa por card (48% + gap) — não depende de onLayout/medição
// dinâmica, por isso nunca colapsa para 0 mesmo que o cálculo de largura
// via container atrase ou falhe. Garante sempre 2 por linha.
const ITEM_BASIS = '48%';

interface DraggableSpacesGridProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  onReorder: (orderedIds: string[]) => void;
}

/**
 * Grade 2 colunas (Flexbox puro, sem medição dinâmica) com reordenação por
 * arrastar-e-largar: segurar (long press) levanta o card com um pequeno
 * "hover" (escala + sombra), arrastar reordena em tempo real, e largar
 * confirma a nova ordem. Os restantes cards deslizam para o novo lugar.
 */
export function DraggableSpacesGrid<T>({ data, keyExtractor, renderItem, onReorder }: DraggableSpacesGridProps<T>) {
  const [order, setOrder] = useState(() => data.map(keyExtractor));
  const orderRef = React.useRef(order);
  orderRef.current = order;

  // Sincroniza a ordem local quando os dados vindos da store mudam (ex.:
  // após fetchSpaces() no fim de um reorder, ou um Space novo criado).
  React.useEffect(() => {
    const incoming = data.map(keyExtractor);
    const sameSet = incoming.length === orderRef.current.length && incoming.every((id) => orderRef.current.includes(id));
    if (!sameSet) setOrder(incoming);
  }, [data, keyExtractor]);

  const byId = new Map(data.map((item) => [keyExtractor(item), item]));

  const commitReorder = (nextOrder: string[]) => {
    setOrder(nextOrder);
    onReorder(nextOrder);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm }}>
      {order.map((id) => {
        const item = byId.get(id);
        if (!item) return null;
        return (
          <DraggableItem key={id} id={id} order={order} onCommit={commitReorder}>
            {renderItem(item)}
          </DraggableItem>
        );
      })}
    </View>
  );
}

function DraggableItem({
  id, order, onCommit, children,
}: {
  id: string;
  order: string[];
  onCommit: (next: string[]) => void;
  children: React.ReactNode;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);

  const moveTo = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onCommit(next);
  };

  // Um único gesto Pan com activateAfterLongPress: o "segurar" (hover/lift)
  // e o "arrastar" ficam garantidamente sincronizados — não há corrida entre
  // dois reconhecedores separados como aconteceria ao compor LongPress + Pan.
  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onBegin(() => {
      scale.value = withSpring(1.06);
      zIndex.value = 10;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const currentIndex = order.indexOf(id);
      // Passo aproximado de uma "célula" da grade: metade da largura visível
      // do ecrã (2 colunas) — usa uma estimativa fixa para não depender de
      // medição de layout em tempo real.
      const approxColStep = 180;
      const approxRowStep = 220;
      const colDelta = Math.round(e.translationX / approxColStep);
      const rowDelta = Math.round(e.translationY / approxRowStep);
      const targetIndex = currentIndex + colDelta + rowDelta * COLUMNS;
      if (targetIndex !== currentIndex) {
        runOnJS(moveTo)(currentIndex, Math.max(0, Math.min(order.length - 1, targetIndex)));
      }
    })
    .onFinalize(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
    shadowOpacity: scale.value > 1 ? 0.3 : 0,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowColor: '#000',
    elevation: scale.value > 1 ? 8 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        layout={LinearTransition.springify().damping(18)}
        style={[{ flexBasis: ITEM_BASIS, flexGrow: 0, flexShrink: 0 }, animatedStyle]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
