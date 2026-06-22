import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";

// Hooks Redux typés — à utiliser partout à la place de useDispatch/useSelector brut.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();