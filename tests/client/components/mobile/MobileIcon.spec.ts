import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MobileIcon from '@/client/components/mobile/MobileIcon.vue';

describe('MobileIcon', () => {
  it('draws the named icon\'s shapes at the size asked for', () => {
    const wrapper = shallowMount(MobileIcon, {...globalConfig, props: {name: 'users', size: 16}});
    expect(wrapper.attributes('width')).eq('16');
    expect(wrapper.findAll('path')).has.length(3);
    expect(wrapper.findAll('circle')).has.length(1);
  });
});
