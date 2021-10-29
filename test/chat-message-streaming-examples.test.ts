// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as ChatMessageStreamingExamples from '../lib/chat-message-streaming-examples-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new ChatMessageStreamingExamples.ChatMessageStreamingExamplesStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
