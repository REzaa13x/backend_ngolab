/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Layout from './components/Layout';
import { BrowserRouter } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
