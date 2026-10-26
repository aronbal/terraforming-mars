import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '@tests/client/components/getLocalVue';
import App from '@/client/components/App.vue';

describe('App', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(App, globalConfig);
    expect(wrapper.exists()).to.be.true;
  });

  // The browser's own alert names the site rather than the problem.
  it('shows an alert in its own dialog, as text', () => {
    const wrapper = shallowMount(App, {...globalConfig, attachTo: document.body});
    const dialog = document.getElementById('alert-dialog') as HTMLElement & {showModal?: () => void};
    let shown = 0;
    dialog.showModal = () => shown++;
    const alert = window.alert;
    let native = 0;
    window.alert = () => native++;
    try {
      wrapper.vm.showAlert('Error with input', 'Not enough <b>M€</b>');
      expect(shown).eq(1);
      expect(native).eq(0);
      expect(document.getElementById('alert-title')?.textContent).eq('Error with input');
      expect(document.getElementById('alert-dialog-message')?.textContent).eq('Not enough <b>M€</b>');
      expect(document.querySelector('#alert-dialog-message b')).is.null;
    } finally {
      window.alert = alert;
      wrapper.unmount();
    }
  });
});
