import React, { Component, Fragment } from 'react'
import InputGroup from '../inputs/InputGroup'
import SelectInput from '../inputs/SelectInput'
import BooleanInput from '../inputs/BooleanInput'
import NumericInputGroup from '../inputs/NumericInputGroup'
import { Vector2 } from 'three'
import { withTranslation } from 'react-i18next'
import { CommandManager } from '../../managers/CommandManager'

/**
 *  Array containing options for shadow resolution
 *
 * @author Robert Long
 */
const ShadowMapResolutionOptions = [
  {
    label: '256px',
    value: new Vector2(256, 256)
  },
  {
    label: '512px',
    value: new Vector2(512, 512)
  },
  {
    label: '1024px',
    value: new Vector2(1024, 1024)
  },
  {
    label: '2048px',
    value: new Vector2(2048, 2048)
  },
  {
    label: '4096px (not recommended)',
    value: new Vector2(4096, 4096)
  }
]

//creating properties for LightShadowProperties component
type LightShadowPropertiesProps = {
  node?: any
  t?: Function
}

/**
 * OnChangeShadowMapResolution used to customize properties of LightShadowProperties
 * Used with LightNodeEditors.
 *
 * @author Robert Long
 * @type {[class component]}
 */
export class LightShadowProperties extends Component<LightShadowPropertiesProps, {}> {
  // function to handle the change in shadowMapResolution propery
  onChangeShadowMapResolution = (shadowMapResolution) => {
    CommandManager.instance.setPropertyOnSelection('shadowMapResolution', shadowMapResolution)
  }

  // function to handle changes in castShadow propery
  onChangeCastShadow = (castShadow) => {
    CommandManager.instance.setPropertyOnSelection('castShadow', castShadow)
  }

  // fucntion to handle changes in shadowBias property
  onChangeShadowBias = (shadowBias) => {
    CommandManager.instance.setPropertyOnSelection('shadowBias', shadowBias)
  }

  // function to handle changes shadowRadius property
  onChangeShadowRadius = (shadowRadius) => {
    CommandManager.instance.setPropertyOnSelection('shadowRadius', shadowRadius)
  }

  //rendering editor view for LightShadowProperties
  render() {
    const node = this.props.node
    return (
      <Fragment>
        <InputGroup name="Cast Shadow" label={this.props.t('editor:properties.directionalLight.lbl-castShadow')}>
          <BooleanInput value={(node as any).castShadow} onChange={this.onChangeCastShadow} />
        </InputGroup>
        <InputGroup
          name="Shadow Map Resolution"
          label={this.props.t('editor:properties.directionalLight.lbl-shadowmapResolution')}
        >
          <SelectInput
            options={ShadowMapResolutionOptions}
            value={(node as any).shadowMapResolution}
            onChange={this.onChangeShadowMapResolution}
          />
        </InputGroup>
        <NumericInputGroup
          name="Shadow Bias"
          label={this.props.t('editor:properties.directionalLight.lbl-shadowBias')}
          mediumStep={0.00001}
          smallStep={0.0001}
          largeStep={0.001}
          displayPrecision={0.000001}
          value={node.shadowBias}
          onChange={this.onChangeShadowBias}
        />
        <NumericInputGroup
          name="Shadow Radius"
          label={this.props.t('editor:properties.directionalLight.lbl-shadowRadius')}
          mediumStep={0.01}
          smallStep={0.1}
          largeStep={1}
          displayPrecision={0.0001}
          value={node.shadowRadius}
          onChange={this.onChangeShadowRadius}
        />
      </Fragment>
    )
  }
}

export default withTranslation()(LightShadowProperties)
